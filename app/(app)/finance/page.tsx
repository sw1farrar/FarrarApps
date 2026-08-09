import Link from "next/link";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, monthToDateRange } from "@/lib/format";
import { calculateAccountBalance } from "@/lib/data/account-balances";
import { getAccountsReceivableOverview } from "@/lib/data/balances";
import { getCashBasisReport } from "@/lib/data/reports";
import type { Account } from "@/lib/types/database";
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

  const kpis = [
    { label: "MTD Profit", value: formatCurrency(income - expenses) },
    {
      label: "Open AR",
      value: formatCurrency(ar.totals.openTotal),
      href: "/finance/ar",
    },
    {
      label: "Pending invoices",
      value: `${(pendingInvoices ?? []).length} · ${formatCurrency(pendingTotal)}`,
      href: "/finance/invoices?status=sent",
    },
    {
      label: "Unreconciled",
      value: String(unreconciledCount ?? 0),
      href: "/finance/transactions?unreconciled=1",
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="shadow-none">
            <CardHeader className="gap-1 p-3 pb-1">
              <CardDescription className="text-xs">{kpi.label}</CardDescription>
              <CardTitle className="text-xl tabular-nums">
                {"href" in kpi && kpi.href ? (
                  <Link href={kpi.href} className="hover:underline">
                    {kpi.value}
                  </Link>
                ) : (
                  kpi.value
                )}
              </CardTitle>
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
