import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate, titleCase } from "@/lib/format";
import type {
  Account,
  Category,
  Customer,
  Project,
  Transaction,
} from "@/lib/types/database";
import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function TransactionsPage() {
  const supabase = await createClient();

  const [
    { data: transactions },
    { data: balanceRows },
    { data: accounts },
    { data: categories },
    { data: customers },
    { data: projects },
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "*, accounts(id, name), categories(id, name, type), customers(id, name)"
      )
      .order("date", { ascending: false })
      .limit(100),
    supabase.from("transactions").select("account_id, type, amount"),
    supabase.from("accounts").select("*").eq("is_active", true).order("name"),
    supabase.from("categories").select("*").order("name"),
    supabase.from("customers").select("*").order("name"),
    supabase.from("projects").select("*").order("name"),
  ]);

  const typedAccounts = (accounts ?? []) as Account[];
  const typedTx = (transactions ?? []) as Transaction[];

  const balances = typedAccounts.map((account) => {
    const related = (balanceRows ?? []).filter(
      (tx) => tx.account_id === account.id
    );
    const delta = related.reduce((sum, tx) => {
      return (
        sum + (tx.type === "income" ? Number(tx.amount) : -Number(tx.amount))
      );
    }, 0);
    return {
      ...account,
      balance: Number(account.opening_balance) + delta,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            Income, expenses, receipts, and account balances.
          </p>
        </div>
        <TransactionFormDialog
          accounts={typedAccounts}
          categories={(categories ?? []) as Category[]}
          customers={(customers ?? []) as Customer[]}
          projects={(projects ?? []) as Project[]}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {balances.map((account) => (
          <Card key={account.id} className="shadow-none">
            <CardHeader className="p-3 pb-1">
              <CardDescription className="text-xs">
                {account.name}
              </CardDescription>
              <CardTitle className="text-xl tabular-nums">
                {formatCurrency(account.balance)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 text-[11px] text-muted-foreground">
              {titleCase(account.type)}
            </CardContent>
          </Card>
        ))}
      </div>

      {typedTx.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-16 text-center">
          <p className="text-sm font-medium">No transactions yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Record income or expenses to feed the dashboard and reports.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {typedTx.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>{formatDate(tx.date)}</TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {tx.description || "Untitled"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {tx.customers?.name || ""}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {tx.accounts?.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {tx.categories?.name || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={tx.type === "income" ? "secondary" : "outline"}
                    >
                      {titleCase(tx.type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {tx.type === "expense" ? "-" : ""}
                    {formatCurrency(tx.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
