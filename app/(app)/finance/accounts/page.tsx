import Link from "next/link";
import { CreditCard, Landmark, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Account } from "@/lib/types/database";
import { AccountFormDialog } from "@/components/finance/account-form-dialog";
import { calculateAccountBalance } from "@/lib/data/account-balances";
import { formatCurrency } from "@/lib/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function accountIcon(type: Account["type"]) {
  if (type === "credit_card") return CreditCard;
  if (type === "stripe") return Wallet;
  return Landmark;
}

function accountTypeLabel(type: Account["type"]) {
  if (type === "credit_card") return "Credit card";
  if (type === "stripe") return "Stripe clearing";
  return "Checking account";
}

export default async function FinanceAccountsPage() {
  const supabase = await createClient();

  const [{ data: accounts }, { data: balanceRows }] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, type, opening_balance, is_active")
      .order("name"),
    supabase
      .from("transactions")
      .select("account_id, transfer_account_id, type, amount"),
  ]);

  const typedAccounts = (accounts ?? []) as Account[];
  const balances = typedAccounts
    .filter((account) => account.is_active)
    .map((account) => ({
      ...account,
      balance: calculateAccountBalance(account, balanceRows ?? []),
    }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          href="/finance/reconcile"
          className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
        >
          Reconcile
        </Link>
        <Link
          href="/finance/categories"
          className={cn(buttonVariants({ size: "sm", variant: "ghost" }))}
        >
          Categories
        </Link>
        <AccountFormDialog />
      </div>

      {balances.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-16 text-center">
          <p className="text-sm font-medium">No bank accounts yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a checking account, credit card, or Stripe clearing account.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {balances.map((account) => {
            const Icon = accountIcon(account.type);
            return (
              <Link key={account.id} href={`/finance/accounts/${account.id}`}>
                <Card className="h-full shadow-none transition-colors hover:bg-muted/35">
                  <CardHeader className="flex-row items-start justify-between gap-3 p-4 pb-2">
                    <div className="space-y-1">
                      <CardDescription>
                        {accountTypeLabel(account.type)}
                      </CardDescription>
                      <CardTitle className="text-base">{account.name}</CardTitle>
                    </div>
                    <Icon className="size-5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    <p className="text-2xl font-semibold tabular-nums">
                      {formatCurrency(account.balance)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {account.type === "credit_card"
                        ? "Current balance owed"
                        : account.type === "stripe"
                          ? "Balance in Stripe"
                          : "Current balance"}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
