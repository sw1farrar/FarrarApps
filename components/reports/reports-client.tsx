"use client";

import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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

export function ReportsClient({
  from,
  to,
  income,
  expenses,
  profit,
  expensesByCategory,
  incomeByClient,
  csvRows,
  formatCurrency,
}: {
  from: string;
  to: string;
  income: number;
  expenses: number;
  profit: number;
  expensesByCategory: { name: string; value: number }[];
  incomeByClient: { name: string; value: number }[];
  csvRows: {
    date: string;
    type: string;
    description: string;
    account: string;
    category: string;
    customer: string;
    amount: number;
  }[];
  formatCurrency: (n: number) => string;
}) {
  const router = useRouter();

  function onRangeSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const nextFrom = String(formData.get("from"));
    const nextTo = String(formData.get("to"));
    router.push(`/reports?from=${nextFrom}&to=${nextTo}`);
  }

  function exportCsv() {
    const header = [
      "date",
      "type",
      "description",
      "account",
      "category",
      "customer",
      "amount",
    ];
    const lines = [
      header.join(","),
      ...csvRows.map((row) =>
        [
          row.date,
          row.type,
          JSON.stringify(row.description),
          JSON.stringify(row.account),
          JSON.stringify(row.category),
          JSON.stringify(row.customer),
          row.amount,
        ].join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `farrar-apps-report-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={onRangeSubmit}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3"
      >
        <div className="space-y-1.5">
          <Label htmlFor="from">From</Label>
          <Input id="from" name="from" type="date" defaultValue={from} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">To</Label>
          <Input id="to" name="to" type="date" defaultValue={to} />
        </div>
        <Button type="submit" size="sm">
          Apply
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={exportCsv}>
          Export CSV
        </Button>
      </form>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="shadow-none">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs">Income</CardDescription>
            <CardTitle className="text-xl tabular-nums">
              {formatCurrency(income)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs">Expenses</CardDescription>
            <CardTitle className="text-xl tabular-nums">
              {formatCurrency(expenses)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs">Profit</CardDescription>
            <CardTitle className="text-xl tabular-nums">
              {formatCurrency(profit)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm">Expenses by category</CardTitle>
          </CardHeader>
          <CardContent className="h-56 p-3 pt-0">
            {expensesByCategory.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expensesByCategory}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={48} />
                  <Tooltip />
                  <Bar dataKey="value" fill="currentColor" className="text-foreground" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No expenses in range
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm">Income by client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-3 pt-0">
            {incomeByClient.length ? (
              incomeByClient.map((row) => (
                <div
                  key={row.name}
                  className="flex items-center justify-between rounded-md border border-border px-2 py-1.5 text-sm"
                >
                  <span>{row.name}</span>
                  <span className="tabular-nums">{formatCurrency(row.value)}</span>
                </div>
              ))
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                No income in range
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
