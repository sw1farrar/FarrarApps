import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Transaction } from "@/lib/types/database";
import { ReportsClient } from "@/components/reports/reports-client";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const to = params.to || new Date().toISOString().slice(0, 10);
  const from =
    params.from ||
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10);

  const supabase = await createClient();
  const { data } = await supabase
    .from("transactions")
    .select(
      "*, categories(id, name, type), customers(id, name), accounts(id, name)"
    )
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true });

  const transactions = (data ?? []) as Transaction[];
  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const expenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const expensesByCategory = new Map<string, number>();
  for (const tx of transactions.filter((t) => t.type === "expense")) {
    const key = tx.categories?.name || "Uncategorized";
    expensesByCategory.set(key, (expensesByCategory.get(key) || 0) + Number(tx.amount));
  }

  const incomeByClient = new Map<string, number>();
  for (const tx of transactions.filter((t) => t.type === "income")) {
    const key = tx.customers?.name || "Unassigned";
    incomeByClient.set(key, (incomeByClient.get(key) || 0) + Number(tx.amount));
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          {formatDate(from)} – {formatDate(to)}
        </p>
      </div>

      <ReportsClient
        from={from}
        to={to}
        income={income}
        expenses={expenses}
        profit={income - expenses}
        expensesByCategory={Array.from(expensesByCategory.entries()).map(
          ([name, value]) => ({ name, value })
        )}
        incomeByClient={Array.from(incomeByClient.entries()).map(
          ([name, value]) => ({ name, value })
        )}
        csvRows={transactions.map((tx) => ({
          date: tx.date,
          type: tx.type,
          description: tx.description || "",
          account: tx.accounts?.name || "",
          category: tx.categories?.name || "",
          customer: tx.customers?.name || "",
          amount: Number(tx.amount),
        }))}
        formatCurrency={formatCurrency}
      />
    </div>
  );
}
