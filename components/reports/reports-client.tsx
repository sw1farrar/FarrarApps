"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatDate } from "@/lib/format";
import type { ReportTxRow } from "@/lib/data/reports";
import type { ArInvoiceRow } from "@/lib/data/balances";
import {
  ReportDrilldownDialog,
  type DrilldownSpec,
} from "@/components/reports/report-drilldown-dialog";
import { InvoiceWorkbenchDialog } from "@/components/invoices/invoice-workbench-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type ReportKey = "pl" | "ar" | "expenses" | "income";

type NamedAmount = {
  name: string;
  value: number;
  key: string;
  customerId?: string | null;
};

export function ReportsClient({
  report,
  from,
  to,
  income,
  expenses,
  profit,
  transfers,
  transferCount,
  incomeCount,
  expenseCount,
  expensesByCategory,
  incomeByClient,
  incomeByCategory,
  byDay,
  arRows,
  arTotals,
  arInvoices,
  plRows,
  transferRows,
}: {
  report: ReportKey;
  from: string;
  to: string;
  income: number;
  expenses: number;
  profit: number;
  transfers: number;
  transferCount: number;
  incomeCount: number;
  expenseCount: number;
  expensesByCategory: NamedAmount[];
  incomeByClient: NamedAmount[];
  incomeByCategory: NamedAmount[];
  byDay: { date: string; income: number; expense: number }[];
  arRows: {
    customerId: string;
    customerName: string;
    company?: string | null;
    openTotal: number;
    overdueTotal: number;
    openCount: number;
    aging: {
      current: number;
      days30: number;
      days60: number;
      days90: number;
    };
  }[];
  arTotals: { openTotal: number; overdueTotal: number; openCount: number };
  arInvoices: ArInvoiceRow[];
  plRows: ReportTxRow[];
  transferRows: ReportTxRow[];
}) {
  const router = useRouter();
  const [drilldown, setDrilldown] = React.useState<DrilldownSpec | null>(null);
  const [drillOpen, setDrillOpen] = React.useState(false);
  const [invoiceId, setInvoiceId] = React.useState<string | null>(null);

  const tabs: { key: ReportKey; label: string }[] = [
    { key: "pl", label: "Profit & loss" },
    { key: "ar", label: "AR aging" },
    { key: "expenses", label: "Expenses by category" },
    { key: "income", label: "Income by customer" },
  ];

  function openDrilldown(spec: DrilldownSpec) {
    setDrilldown(spec);
    setDrillOpen(true);
  }

  function openInvoice(id: string) {
    setInvoiceId(id);
  }

  function incomeRows() {
    return plRows.filter((r) => r.type === "income");
  }

  function expenseRows() {
    return plRows.filter((r) => r.type === "expense");
  }

  function pushReport(next: ReportKey, nextFrom = from, nextTo = to) {
    const params = new URLSearchParams({
      report: next,
      from: nextFrom,
      to: nextTo,
    });
    router.push(`/finance/reports?${params.toString()}`);
  }

  function onRangeSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    pushReport(
      report,
      String(formData.get("from")),
      String(formData.get("to"))
    );
  }

  function exportCsv() {
    if (report === "ar") {
      const header = [
        "customer",
        "open",
        "overdue",
        "current",
        "days_1_30",
        "days_31_60",
        "days_61_plus",
        "invoices",
      ];
      const lines = [
        header.join(","),
        ...arRows.map((row) =>
          [
            JSON.stringify(row.customerName),
            row.openTotal,
            row.overdueTotal,
            row.aging.current,
            row.aging.days30,
            row.aging.days60,
            row.aging.days90,
            row.openCount,
          ].join(",")
        ),
      ];
      downloadCsv(lines.join("\n"), `ar-aging-${from}.csv`);
      return;
    }

    if (report === "expenses") {
      const lines = [
        "category,amount",
        ...expensesByCategory.map(
          (r) => `${JSON.stringify(r.name)},${r.value}`
        ),
      ];
      downloadCsv(lines.join("\n"), `expenses-by-category-${from}-${to}.csv`);
      return;
    }

    if (report === "income") {
      const lines = [
        "customer,amount",
        ...incomeByClient.map((r) => `${JSON.stringify(r.name)},${r.value}`),
        "",
        "category,amount",
        ...incomeByCategory.map((r) => `${JSON.stringify(r.name)},${r.value}`),
      ];
      downloadCsv(lines.join("\n"), `income-by-customer-${from}-${to}.csv`);
      return;
    }

    const header = [
      "date",
      "type",
      "description",
      "account",
      "category",
      "customer",
      "project",
      "invoice",
      "amount",
    ];
    const lines = [
      header.join(","),
      ...plRows.map((row) =>
        [
          row.date,
          row.type,
          JSON.stringify(row.description),
          JSON.stringify(row.account),
          JSON.stringify(row.category),
          JSON.stringify(row.customer),
          JSON.stringify(row.project),
          JSON.stringify(row.invoiceNumber || ""),
          row.amount,
        ].join(",")
      ),
      "",
      `income_total,,${income}`,
      `expense_total,,${expenses}`,
      `profit,,${profit}`,
      `transfers_excluded,,${transfers}`,
    ];
    downloadCsv(lines.join("\n"), `profit-loss-${from}-${to}.csv`);
  }

  return (
    <div className="space-y-4">
      <div className="w-full border-b border-border">
        <div className="mx-auto grid w-full max-w-4xl grid-cols-2 gap-x-2 sm:grid-cols-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => pushReport(tab.key)}
              className={cn(
                "inline-flex h-9 w-full items-center justify-center border-b-2 px-1 text-center text-sm font-medium transition-colors",
                report === tab.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {report !== "ar" ? (
        <form
          onSubmit={onRangeSubmit}
          className="flex flex-wrap items-end justify-center gap-3"
        >
          <div className="space-y-1">
            <Label htmlFor="from" className="text-xs">
              From
            </Label>
            <Input
              id="from"
              name="from"
              type="date"
              defaultValue={from}
              className="h-8 w-40"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to" className="text-xs">
              To
            </Label>
            <Input
              id="to"
              name="to"
              type="date"
              defaultValue={to}
              className="h-8 w-40"
            />
          </div>
          <Button type="submit" size="sm" variant="outline">
            Update range
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={exportCsv}>
            Export CSV
          </Button>
        </form>
      ) : (
        <div className="flex justify-center">
          <Button type="button" size="sm" variant="ghost" onClick={exportCsv}>
            Export CSV
          </Button>
        </div>
      )}

      {report === "pl" ? (
        <>
          <p className="text-center text-xs text-muted-foreground">
            Cash-basis P&amp;L for {formatDate(from)} – {formatDate(to)}. Click
            any total to see the line items. Click a customer, project, or
            invoice to open it.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              title="Income"
              value={formatCurrency(income)}
              hint={`${incomeCount} payment${incomeCount === 1 ? "" : "s"} · click for detail`}
              onClick={() =>
                openDrilldown({
                  kind: "tx",
                  title: "Income",
                  description: `Payments received ${formatDate(from)} – ${formatDate(to)}`,
                  rows: incomeRows(),
                })
              }
            />
            <Metric
              title="Expenses"
              value={formatCurrency(expenses)}
              hint={`${expenseCount} expense${expenseCount === 1 ? "" : "s"} · click for detail`}
              onClick={() =>
                openDrilldown({
                  kind: "tx",
                  title: "Expenses",
                  description: `Expenses ${formatDate(from)} – ${formatDate(to)}`,
                  rows: expenseRows(),
                })
              }
            />
            <Metric
              title="Profit"
              value={formatCurrency(profit)}
              hint={
                profit >= 0
                  ? "Income − expenses · click for detail"
                  : "Net loss · click for detail"
              }
              emphasize={profit < 0 ? "neg" : profit > 0 ? "pos" : undefined}
              onClick={() =>
                openDrilldown({
                  kind: "tx",
                  title: "Profit & loss detail",
                  description: `Income and expenses ${formatDate(from)} – ${formatDate(to)}`,
                  rows: plRows,
                  sumMode: "signed",
                })
              }
            />
            <Metric
              title="Transfers (excluded)"
              value={formatCurrency(transfers)}
              hint={`${transferCount} transfer${transferCount === 1 ? "" : "s"} · not in P&L`}
              onClick={() =>
                openDrilldown({
                  kind: "tx",
                  title: "Transfers",
                  description:
                    "Balance moves between accounts (Stripe payouts, card payments). Not income or expense.",
                  rows: transferRows,
                })
              }
            />
          </div>
          <Card className="shadow-none">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm">Cash activity by day</CardTitle>
              <CardDescription className="text-xs">
                Click a bar to drill into that day
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[260px] p-3 pt-0">
              {byDay.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No income or expenses in this range.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={byDay}
                    onClick={(state) => {
                      const date = (state as { activeLabel?: string })
                        ?.activeLabel;
                      if (!date) return;
                      const rows = plRows.filter((r) => r.date === date);
                      openDrilldown({
                        kind: "tx",
                        title: `Activity · ${formatDate(date)}`,
                        description: "Income and expenses on this day",
                        rows,
                        sumMode: "signed",
                      });
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-border"
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => {
                        try {
                          return formatDate(String(v)).replace(/, \d{4}$/, "");
                        } catch {
                          return String(v);
                        }
                      }}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(v) => formatCurrency(Number(v ?? 0))}
                      labelFormatter={(label) => formatDate(String(label))}
                    />
                    <Legend />
                    <Bar
                      dataKey="income"
                      name="Income"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                      cursor="pointer"
                      onClick={(data) => {
                        const date = (data as { date?: string })?.date;
                        if (!date) return;
                        openDrilldown({
                          kind: "tx",
                          title: `Income · ${formatDate(date)}`,
                          rows: plRows.filter(
                            (r) => r.date === date && r.type === "income"
                          ),
                        });
                      }}
                    />
                    <Bar
                      dataKey="expense"
                      name="Expenses"
                      fill="hsl(var(--muted-foreground) / 0.45)"
                      radius={[4, 4, 0, 0]}
                      cursor="pointer"
                      onClick={(data) => {
                        const date = (data as { date?: string })?.date;
                        if (!date) return;
                        openDrilldown({
                          kind: "tx",
                          title: `Expenses · ${formatDate(date)}`,
                          rows: plRows.filter(
                            (r) => r.date === date && r.type === "expense"
                          ),
                        });
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <ActivityTable
            rows={plRows}
            onOpenInvoice={openInvoice}
            onOpenAmount={(row) =>
              openDrilldown({
                kind: "tx",
                title: row.type === "income" ? "Income" : "Expense",
                description: row.description || undefined,
                rows: [row],
              })
            }
          />
        </>
      ) : null}

      {report === "ar" ? (
        <>
          <p className="text-center text-xs text-muted-foreground">
            Open receivables as of today. Click any amount to list the invoices.
            Click a customer or invoice to open it.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric
              title="Open AR"
              value={formatCurrency(arTotals.openTotal)}
              hint="Click for all open invoices"
              onClick={() =>
                openDrilldown({
                  kind: "ar",
                  title: "Open AR",
                  description: "All sent and overdue invoices",
                  rows: arInvoices,
                })
              }
            />
            <Metric
              title="Overdue"
              value={formatCurrency(arTotals.overdueTotal)}
              hint="Click for overdue invoices"
              onClick={() =>
                openDrilldown({
                  kind: "ar",
                  title: "Overdue AR",
                  description: "Invoices past due date",
                  rows: arInvoices.filter((i) => i.isOverdue),
                })
              }
            />
            <Metric
              title="Open invoices"
              value={String(arTotals.openCount)}
              hint="Click for invoice list"
              onClick={() =>
                openDrilldown({
                  kind: "ar",
                  title: "Open invoices",
                  rows: arInvoices,
                })
              }
            />
          </div>
          <Card className="shadow-none">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Customer</th>
                      <th className="px-3 py-2 text-right font-medium">Open</th>
                      <th className="px-3 py-2 text-right font-medium">
                        Current
                      </th>
                      <th className="px-3 py-2 text-right font-medium">1–30</th>
                      <th className="px-3 py-2 text-right font-medium">31–60</th>
                      <th className="px-3 py-2 text-right font-medium">61+</th>
                    </tr>
                  </thead>
                  <tbody>
                    {arRows.length ? (
                      arRows.map((row) => {
                        const custInvoices = arInvoices.filter(
                          (i) => i.customerId === row.customerId
                        );
                        return (
                          <tr
                            key={row.customerId}
                            className="border-b border-border last:border-0"
                          >
                            <td className="px-3 py-2">
                              <Link
                                href={`/customers/${row.customerId}`}
                                className="font-medium hover:underline"
                              >
                                {row.customerName}
                              </Link>
                              <span className="mx-1.5 text-muted-foreground">
                                ·
                              </span>
                              <Link
                                href={`/finance/ar/${row.customerId}`}
                                className="text-xs text-muted-foreground hover:underline"
                              >
                                AR detail
                              </Link>
                              {row.company ? (
                                <p className="text-xs text-muted-foreground">
                                  {row.company}
                                </p>
                              ) : null}
                            </td>
                            <AmountCell
                              amount={row.openTotal}
                              onClick={() =>
                                openDrilldown({
                                  kind: "ar",
                                  title: `Open AR · ${row.customerName}`,
                                  rows: custInvoices,
                                })
                              }
                            />
                            <AmountCell
                              amount={row.aging.current}
                              muted
                              onClick={() =>
                                openDrilldown({
                                  kind: "ar",
                                  title: `Current · ${row.customerName}`,
                                  rows: custInvoices.filter(
                                    (i) => i.agingBucket === "current"
                                  ),
                                })
                              }
                            />
                            <AmountCell
                              amount={row.aging.days30}
                              muted
                              onClick={() =>
                                openDrilldown({
                                  kind: "ar",
                                  title: `1–30 days · ${row.customerName}`,
                                  rows: custInvoices.filter(
                                    (i) => i.agingBucket === "days30"
                                  ),
                                })
                              }
                            />
                            <AmountCell
                              amount={row.aging.days60}
                              muted
                              onClick={() =>
                                openDrilldown({
                                  kind: "ar",
                                  title: `31–60 days · ${row.customerName}`,
                                  rows: custInvoices.filter(
                                    (i) => i.agingBucket === "days60"
                                  ),
                                })
                              }
                            />
                            <AmountCell
                              amount={row.aging.days90}
                              muted
                              onClick={() =>
                                openDrilldown({
                                  kind: "ar",
                                  title: `61+ days · ${row.customerName}`,
                                  rows: custInvoices.filter(
                                    (i) => i.agingBucket === "days90"
                                  ),
                                })
                              }
                            />
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-6 text-center text-muted-foreground"
                        >
                          No open receivables.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}

      {report === "expenses" ? (
        <div className="space-y-3">
          <p className="text-center text-xs text-muted-foreground">
            Cash expenses posted {formatDate(from)} – {formatDate(to)}. Click a
            category total for the underlying expenses.
          </p>
          <BreakdownCard
            title="Expenses by category"
            rows={expensesByCategory}
            empty="No expenses in this range."
            onRowClick={(row) =>
              openDrilldown({
                kind: "tx",
                title: `Expenses · ${row.name}`,
                description: `${formatDate(from)} – ${formatDate(to)}`,
                rows: expenseRows().filter(
                  (r) => (r.category || "Uncategorized") === row.name
                ),
              })
            }
            onTotalClick={() =>
              openDrilldown({
                kind: "tx",
                title: "All expenses",
                description: `${formatDate(from)} – ${formatDate(to)}`,
                rows: expenseRows(),
              })
            }
          />
        </div>
      ) : null}

      {report === "income" ? (
        <div className="space-y-3">
          <p className="text-center text-xs text-muted-foreground">
            Cash income posted {formatDate(from)} – {formatDate(to)}. Click a
            total to list payments; click a customer name to open their profile.
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            <BreakdownCard
              title="Income by customer"
              rows={incomeByClient}
              empty="No income in this range."
              nameHref={(row) =>
                row.customerId ? `/customers/${row.customerId}` : null
              }
              onRowClick={(row) =>
                openDrilldown({
                  kind: "tx",
                  title: `Income · ${row.name}`,
                  description: `${formatDate(from)} – ${formatDate(to)}`,
                  rows: incomeRows().filter((r) => {
                    if (row.customerId) return r.customerId === row.customerId;
                    return (r.customer || "Unassigned") === row.name;
                  }),
                })
              }
              onTotalClick={() =>
                openDrilldown({
                  kind: "tx",
                  title: "All income",
                  description: `${formatDate(from)} – ${formatDate(to)}`,
                  rows: incomeRows(),
                })
              }
            />
            <BreakdownCard
              title="Income by category"
              rows={incomeByCategory}
              empty="No income in this range."
              onRowClick={(row) =>
                openDrilldown({
                  kind: "tx",
                  title: `Income · ${row.name}`,
                  description: `${formatDate(from)} – ${formatDate(to)}`,
                  rows: incomeRows().filter(
                    (r) => (r.category || "Uncategorized") === row.name
                  ),
                })
              }
              onTotalClick={() =>
                openDrilldown({
                  kind: "tx",
                  title: "All income",
                  description: `${formatDate(from)} – ${formatDate(to)}`,
                  rows: incomeRows(),
                })
              }
            />
          </div>
        </div>
      ) : null}

      <ReportDrilldownDialog
        open={drillOpen}
        onOpenChange={setDrillOpen}
        spec={drilldown}
        onOpenInvoice={openInvoice}
      />
      <InvoiceWorkbenchDialog
        invoiceId={invoiceId}
        open={Boolean(invoiceId)}
        onOpenChange={(open) => {
          if (!open) setInvoiceId(null);
        }}
        onChanged={() => router.refresh()}
      />
    </div>
  );
}

function Metric({
  title,
  value,
  hint,
  emphasize,
  onClick,
}: {
  title: string;
  value: string;
  hint?: string;
  emphasize?: "pos" | "neg";
  onClick?: () => void;
}) {
  const interactive = Boolean(onClick);
  return (
    <Card
      className={cn(
        "shadow-none",
        interactive &&
          "cursor-pointer transition-colors hover:border-primary/40 hover:bg-muted/30"
      )}
    >
      <CardHeader
        className="p-3 pb-1"
        onClick={onClick}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClick?.();
                }
              }
            : undefined
        }
      >
        <CardDescription className="text-xs">{title}</CardDescription>
        <CardTitle
          className={cn(
            "text-xl tabular-nums",
            interactive && "underline-offset-4 group-hover:underline",
            emphasize === "pos" && "text-emerald-600 dark:text-emerald-400",
            emphasize === "neg" && "text-red-600 dark:text-red-400"
          )}
        >
          {value}
        </CardTitle>
        {hint ? (
          <p className="text-[11px] text-muted-foreground">{hint}</p>
        ) : null}
      </CardHeader>
    </Card>
  );
}

function AmountCell({
  amount,
  muted,
  onClick,
}: {
  amount: number;
  muted?: boolean;
  onClick?: () => void;
}) {
  return (
    <td className="px-3 py-2 text-right">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "tabular-nums font-medium underline-offset-2 hover:underline",
          muted ? "text-muted-foreground" : "text-foreground",
          amount === 0 && "cursor-default opacity-50 hover:no-underline"
        )}
        disabled={amount === 0 && !onClick}
      >
        {formatCurrency(amount)}
      </button>
    </td>
  );
}

function BreakdownCard({
  title,
  rows,
  empty,
  onRowClick,
  onTotalClick,
  nameHref,
}: {
  title: string;
  rows: NamedAmount[];
  empty: string;
  onRowClick?: (row: NamedAmount) => void;
  onTotalClick?: () => void;
  nameHref?: (row: NamedAmount) => string | null;
}) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <Card className="shadow-none">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        {rows.length ? (
          <CardDescription className="text-xs">
            {rows.length} group{rows.length === 1 ? "" : "s"} ·{" "}
            {onTotalClick ? (
              <button
                type="button"
                onClick={onTotalClick}
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                {formatCurrency(total)}
              </button>
            ) : (
              formatCurrency(total)
            )}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2 p-3 pt-0">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          rows.map((row) => {
            const pct = total > 0 ? (row.value / total) * 100 : 0;
            const href = nameHref?.(row) ?? null;
            return (
              <div key={row.key || row.name} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  {href ? (
                    <Link
                      href={href}
                      className="truncate font-medium hover:underline"
                    >
                      {row.name}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="truncate text-left hover:underline"
                      onClick={() => onRowClick?.(row)}
                    >
                      {row.name}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onRowClick?.(row)}
                    className="shrink-0 tabular-nums font-medium underline-offset-2 hover:underline"
                  >
                    {formatCurrency(row.value)}
                  </button>
                </div>
                <button
                  type="button"
                  className="block h-1.5 w-full overflow-hidden rounded-full bg-muted text-left"
                  onClick={() => onRowClick?.(row)}
                  aria-label={`Open ${row.name} detail`}
                >
                  <span
                    className="block h-full rounded-full bg-primary/80"
                    style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }}
                  />
                </button>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function ActivityTable({
  rows,
  onOpenInvoice,
  onOpenAmount,
}: {
  rows: ReportTxRow[];
  onOpenInvoice: (id: string) => void;
  onOpenAmount: (row: ReportTxRow) => void;
}) {
  return (
    <Card className="shadow-none">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-sm">Activity detail</CardTitle>
        <CardDescription className="text-xs">
          {rows.length} income/expense line{rows.length === 1 ? "" : "s"} ·
          click invoice, customer, or project to open
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium">Customer</th>
                <th className="px-3 py-2 font-medium">Project</th>
                <th className="px-3 py-2 font-medium">Invoice</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {formatDate(row.date)}
                    </td>
                    <td className="px-3 py-2 capitalize">
                      {row.type === "income" ? "Income" : "Expense"}
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-2">
                      {row.description || "—"}
                    </td>
                    <td className="px-3 py-2">
                      {row.customerId ? (
                        <Link
                          href={`/customers/${row.customerId}`}
                          className="font-medium hover:underline"
                        >
                          {row.customer}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">
                          {row.customer || "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.projectId ? (
                        <Link
                          href={`/projects/${row.projectId}`}
                          className="font-medium hover:underline"
                        >
                          {row.project}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.invoiceId && row.invoiceNumber ? (
                        <button
                          type="button"
                          onClick={() => onOpenInvoice(row.invoiceId!)}
                          className="font-medium text-primary hover:underline"
                        >
                          {row.invoiceNumber}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.category || "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenAmount(row)}
                        className={cn(
                          "tabular-nums font-medium hover:underline",
                          row.type === "expense" && "text-muted-foreground"
                        )}
                      >
                        {row.type === "expense" ? "−" : ""}
                        {formatCurrency(row.amount)}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-6 text-center text-muted-foreground"
                  >
                    No income or expenses in this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
