import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRightLeft, CreditCard, Scale } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  amountForAccount,
  calculateAccountBalance,
} from "@/lib/data/account-balances";
import { formatCurrency } from "@/lib/format";
import type { Account, Transaction } from "@/lib/types/database";
import { AccountFormDialog } from "@/components/finance/account-form-dialog";
import { DeleteAccountButton } from "@/components/finance/delete-account-button";
import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog";
import { TransactionsTable } from "@/components/transactions/transactions-table";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function typeLabel(type: Account["type"]) {
  if (type === "credit_card") return "Credit card";
  if (type === "stripe") return "Stripe clearing";
  return "Checking account";
}

export default async function FinanceAccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: accountData }, { data: transactionData }] = await Promise.all([
    supabase.from("accounts").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("transactions")
      .select(
        "id, account_id, transfer_account_id, category_id, customer_id, project_id, invoice_id, type, amount, date, description, reference, receipt_path, reconciled_at, reconciled_by, created_by, created_at, updated_at, accounts!transactions_account_id_fkey(id, name), transfer_accounts:accounts!transactions_transfer_account_id_fkey(id, name), categories(id, name, type), customers(id, name), invoices(id, invoice_number)"
      )
      .or(`account_id.eq.${id},transfer_account_id.eq.${id}`)
      .order("date", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (!accountData) notFound();
  const account = accountData as Account;
  const chronological = (transactionData ?? []) as unknown as Transaction[];
  const balance = calculateAccountBalance(account, chronological);

  // Running balance: oldest → newest, then display newest first
  let running = Number(account.opening_balance) || 0;
  const withRunning = chronological.map((tx) => {
    running += amountForAccount(account, tx);
    return { tx, running };
  });
  const displayRows = [...withRunning].reverse();
  const runningBalances = Object.fromEntries(
    withRunning.map(({ tx, running: run }) => [tx.id, run])
  );
  const displayTransactions = displayRows.map(({ tx }) => tx);

  return (
    <div className="space-y-4">
      <Link
        href="/finance/accounts"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Bank accounts
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {typeLabel(account.type)}
          </p>
          <h2 className="text-xl font-semibold">{account.name}</h2>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatCurrency(balance)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Starting balance {formatCurrency(Number(account.opening_balance) || 0)}
            {account.type === "stripe"
              ? " · Online payments land here; transfer to checking when Stripe pays out."
              : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AccountFormDialog account={account} />
          <DeleteAccountButton
            accountId={account.id}
            accountName={account.name}
          />
          <Link
            href={`/finance/reconcile?accountId=${account.id}`}
            className={cn(
              buttonVariants({ size: "sm", variant: "outline" }),
              "gap-1.5"
            )}
          >
            <Scale className="size-4" />
            Reconcile
          </Link>
          {account.type === "credit_card" ? (
            <TransactionFormDialog
              lazyLoad
              transferIntent="card_payment"
              initialTransferAccountId={account.id}
              defaultDescription="Credit card payment"
              trigger={
                <Button size="sm" type="button">
                  <CreditCard className="size-4" />
                  Make payment
                </Button>
              }
            />
          ) : null}
          {account.type === "stripe" ? (
            <TransactionFormDialog
              lazyLoad
              transferIntent="stripe_payout"
              initialAccountId={account.id}
              defaultAmount={balance > 0 ? balance : undefined}
              defaultDescription="Stripe payout to bank"
              trigger={
                <Button size="sm" type="button">
                  <ArrowRightLeft className="size-4" />
                  Record payout to bank
                </Button>
              }
            />
          ) : null}
          <TransactionFormDialog
            lazyLoad
            initialAccountId={account.id}
            trigger={
              <Button
                size="sm"
                type="button"
                variant={
                  account.type === "credit_card" || account.type === "stripe"
                    ? "outline"
                    : "default"
                }
              >
                Add transaction
              </Button>
            }
          />
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">Transaction history</h3>
        <p className="mb-2 text-xs text-muted-foreground">
          Click a row for full details. Starting balance:{" "}
          {formatCurrency(Number(account.opening_balance) || 0)}.
        </p>
        {displayTransactions.length ? (
          <TransactionsTable
            transactions={displayTransactions}
            account={account}
            runningBalances={runningBalances}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-border px-4 py-16 text-center">
            <p className="text-sm font-medium">
              No transactions for this account
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
