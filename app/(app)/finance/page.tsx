import Link from "next/link";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, monthToDateRange } from "@/lib/format";
import { calculateAccountBalance } from "@/lib/data/account-balances";
import { getAccountsReceivableOverview } from "@/lib/data/balances";
import { getCashBasisReport } from "@/lib/data/reports";
import type { Account } from "@/lib/types/database";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DashboardChart = dynamic(
  () =>
    import("@/components/dashboard/dashboard-chart").then(
      (mod) => mod.DashboardChart
    ),
  {
    loading: () => (
      <div className="h-[260px] animate-pulse rounded-md bg-muted/40" />
    ),
  }
);

export default async function FinanceOverviewPage() {
  const supabase = await createClient();
  const { start, end } = monthToDateRange();

  const [
    { data: pendingInvoices },
    mtdReport,
    { data: accounts },
    { data: balanceRows },
    { count: unreconciledCount },
    ar,
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select("total")
      .in("status", ["sent", "overdue"]),
    // Same cash-basis rules as Finance → Reports (excludes transfers)
    getCashBasisReport(start, end),
    supabase
      .from("accounts")
      .select("id, name, type, opening_balance, is_active")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("transactions")
      .select("account_id, transfer_account_id, type, amount"),
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .is("reconciled_at", null),
    getAccountsReceivableOverview(),
  ]);

  const income = mtdReport.income;
  const expenses = mtdReport.expenses;
  const pendingTotal = (pendingInvoices ?? []).reduce(
    (sum, inv) => sum + Number(inv.total),
    0
  );

  const typedAccounts = (accounts ?? []) as Account[];
  const stripeBalance = typedAccounts
    .filter((a) => a.type === "stripe")
    .reduce(
      (sum, a) => sum + calculateAccountBalance(a, balanceRows ?? []),
      0
    );

  const profit = income - expenses;
  const kpis = [
    {
      label: "MTD Profit",
      value: formatCurrency(profit),
      hint: "This month",
      tone:
        profit > 0
          ? ("positive" as const)
          : profit < 0
            ? ("warning" as const)
            : ("default" as const),
    },
    {
      label: "Open AR",
      value: formatCurrency(ar.totals.openTotal),
      hint: `${ar.totals.openCount} open`,
      href: "/finance/ar",
    },
    {
      label: "Pending invoices",
      value: formatCurrency(pendingTotal),
      hint: `${(pendingInvoices ?? []).length} sent / overdue`,
      href: "/finance/invoices?status=sent",
    },
    {
      label: "Unreconciled",
      value: String(unreconciledCount ?? 0),
      hint: "Transactions",
      href: "/finance/transactions?unreconciled=1",
      tone:
        (unreconciledCount ?? 0) > 0
          ? ("warning" as const)
          : ("default" as const),
    },
    {
      label: "Stripe balance",
      value: formatCurrency(stripeBalance),
      href: "/finance/accounts",
    },
  ];

  const chartData = mtdReport.byDay;

  const balances = typedAccounts.map((account) => {
    return {
      id: account.id,
      name: account.name,
      balance: calculateAccountBalance(account, balanceRows ?? []),
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          href="/finance/transactions"
          className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
        >
          New transaction
        </Link>
        <Link
          href="/finance/invoices/new"
          className={cn(buttonVariants({ size: "sm" }))}
        >
          New invoice
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <KpiTile
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            hint={"hint" in kpi ? kpi.hint : undefined}
            href={"href" in kpi ? kpi.href : undefined}
            tone={"tone" in kpi ? kpi.tone : "default"}
          />
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
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-sm">Account balances</CardTitle>
                <CardDescription className="text-xs">
                  Active accounts
                </CardDescription>
              </div>
              <Link
                href="/finance/accounts"
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Manage
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 p-3 pt-0">
            {balances.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No accounts yet.{" "}
                <Link href="/finance/accounts" className="underline">
                  Add one
                </Link>
              </p>
            ) : (
              balances.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between rounded-md border border-border px-2 py-1.5 text-sm"
                >
                  <span className="font-medium">{account.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatCurrency(account.balance)}
                  </span>
                </div>
              ))
            )}
            <Link
              href="/finance/reports"
              className="block text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              View full reports →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
