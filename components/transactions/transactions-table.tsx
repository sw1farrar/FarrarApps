"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { amountForAccount } from "@/lib/data/account-balances";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Account, Transaction } from "@/lib/types/database";
import { TransactionDetailDialog } from "@/components/transactions/transaction-detail-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const TYPE_LABELS = {
  income: "Payment received",
  expense: "Expense",
  transfer: "Transfer",
} as const;

export function TransactionsTable({
  transactions,
  account,
  runningBalances,
  onInvoiceClick,
}: {
  transactions: Transaction[];
  /** When set, amounts are signed for this account (ledger view). */
  account?: Account;
  /** Optional running balance by transaction id (ledger view). */
  runningBalances?: Record<string, number>;
  onInvoiceClick?: (invoiceId: string) => void;
}) {
  const [selected, setSelected] = React.useState<Transaction | null>(null);
  const showRunning = Boolean(account && runningBalances);
  // Hide account column on single-account ledger
  const showAccountCol = !account;

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table
          className={cn(
            showRunning
              ? "min-w-[640px]"
              : showAccountCol
                ? "min-w-[640px]"
                : "min-w-[560px]"
          )}
        >
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              {showAccountCol ? (
                <TableHead className="hidden lg:table-cell">Account</TableHead>
              ) : null}
              <TableHead>Type</TableHead>
              <TableHead className="min-w-40">Description</TableHead>
              <TableHead className="hidden md:table-cell">Customer</TableHead>
              <TableHead className="hidden xl:table-cell">Category</TableHead>
              <TableHead className="hidden text-center lg:table-cell">
                Reconciled
              </TableHead>
              <TableHead className="text-right">Amount</TableHead>
              {showRunning ? (
                <TableHead className="text-right">Balance</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction) => {
              const displayAmount = account
                ? amountForAccount(account, transaction)
                : Number(transaction.amount);
              const isNegative = account
                ? displayAmount < 0
                : transaction.type === "expense";

              return (
                <TableRow
                  key={transaction.id}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => setSelected(transaction)}
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(transaction);
                    }
                  }}
                >
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatDate(transaction.date)}
                  </TableCell>
                  {showAccountCol ? (
                    <TableCell className="hidden whitespace-nowrap lg:table-cell">
                      {transaction.type === "transfer" ? (
                        <span className="text-sm">
                          {transaction.account_id ? (
                            <Link
                              href={`/finance/accounts/${transaction.account_id}`}
                              className="text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {transaction.accounts?.name || "—"}
                            </Link>
                          ) : (
                            "—"
                          )}
                          <span className="mx-1 text-muted-foreground">→</span>
                          {transaction.transfer_account_id ? (
                            <Link
                              href={`/finance/accounts/${transaction.transfer_account_id}`}
                              className="text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {transaction.transfer_accounts?.name || "—"}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </span>
                      ) : transaction.account_id ? (
                        <Link
                          href={`/finance/accounts/${transaction.account_id}`}
                          className="text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {transaction.accounts?.name || "—"}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <Badge
                      variant={
                        transaction.type === "income" ? "secondary" : "outline"
                      }
                    >
                      {TYPE_LABELS[transaction.type]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">
                      {transaction.description || "Untitled"}
                    </p>
                    {transaction.invoices?.invoice_number &&
                    transaction.invoice_id ? (
                      onInvoiceClick ? (
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            onInvoiceClick(transaction.invoice_id!);
                          }}
                        >
                          Invoice {transaction.invoices.invoice_number}
                        </button>
                      ) : (
                        <Link
                          href={`/finance/invoices/${transaction.invoice_id}`}
                          className="text-xs text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Invoice {transaction.invoices.invoice_number}
                        </Link>
                      )
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {transaction.customer_id && transaction.customers?.name ? (
                      <Link
                        href={`/customers/${transaction.customer_id}`}
                        className="text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {transaction.customers.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground xl:table-cell">
                    {transaction.type === "expense"
                      ? transaction.categories?.name || "Uncategorized"
                      : transaction.type === "income"
                        ? transaction.categories?.name || "—"
                        : "—"}
                  </TableCell>
                  <TableCell className="hidden text-center lg:table-cell">
                    {transaction.reconciled_at ? (
                      <Check
                        className="mx-auto size-4 text-foreground"
                        aria-label="Reconciled"
                      />
                    ) : (
                      <Minus
                        className="mx-auto size-4 text-muted-foreground"
                        aria-label="Not reconciled"
                      />
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "whitespace-nowrap text-right tabular-nums",
                      isNegative && "text-muted-foreground"
                    )}
                  >
                    {isNegative ? "−" : ""}
                    {formatCurrency(Math.abs(displayAmount))}
                  </TableCell>
                  {showRunning ? (
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(runningBalances?.[transaction.id] ?? 0)}
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <TransactionDetailDialog
        transaction={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        account={account}
      />
    </>
  );
}
