"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Building2,
  Check,
  ExternalLink,
  FileText,
  Minus,
} from "lucide-react";
import {
  deleteTransaction,
  getReceiptSignedUrl,
  setTransactionReconciled,
} from "@/lib/data/transactions";
import { amountForAccount } from "@/lib/data/account-balances";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Account, Transaction } from "@/lib/types/database";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const TYPE_LABELS = {
  income: "Payment received",
  expense: "Expense",
  transfer: "Transfer",
} as const;

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 border-b border-border py-3 last:border-0 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 text-sm text-foreground">{children}</dd>
    </div>
  );
}

export function TransactionDetailDialog({
  transaction,
  open,
  onOpenChange,
  account,
}: {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When viewing from a bank ledger, show signed amount for that account. */
  account?: Account;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = React.useState(false);
  const tx = transaction;

  if (!tx) return null;

  const displayAmount = account
    ? amountForAccount(account, tx)
    : Number(tx.amount);
  const isNegative = account
    ? displayAmount < 0
    : tx.type === "expense";

  async function openReceipt() {
    if (!tx?.receipt_path) return;
    const result = await getReceiptSignedUrl(tx.receipt_path);
    if (!result.ok || !result.url) {
      toast.error(result.ok ? "Receipt link unavailable" : result.error);
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  async function onReconcile() {
    if (!tx) return;
    setBusy(true);
    const result = await setTransactionReconciled(tx.id, !tx.reconciled_at);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      tx.reconciled_at ? "Transaction reopened" : "Transaction reconciled"
    );
    onOpenChange(false);
    router.refresh();
  }

  async function onDelete() {
    if (!tx) return;
    const ok = await confirm({
      title: "Delete this transaction?",
      description: "This cannot be undone.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    const result = await deleteTransaction(tx.id);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Transaction deleted");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92dvh,90vh)] w-[calc(100vw-2rem)] max-w-2xl gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-2 pr-8">
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-lg">
                {tx.description || "Transaction"}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                {formatDate(tx.date)}
              </p>
            </div>
            <Badge
              variant={tx.type === "income" ? "secondary" : "outline"}
              className="shrink-0"
            >
              {TYPE_LABELS[tx.type]}
            </Badge>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-2 sm:px-6">
          <div className="mb-4 rounded-xl border border-border bg-muted/20 px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Amount
            </p>
            <p
              className={`mt-1 text-3xl font-semibold tabular-nums tracking-tight ${
                isNegative ? "text-muted-foreground" : "text-foreground"
              }`}
            >
              {isNegative ? "−" : ""}
              {formatCurrency(Math.abs(displayAmount))}
            </p>
            {account ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Effect on {account.name}
              </p>
            ) : null}
          </div>

          <dl>
            <DetailRow label="Account">
              {tx.type === "transfer" ? (
                <span className="inline-flex flex-wrap items-center gap-1">
                  {tx.account_id ? (
                    <Link
                      href={`/finance/accounts/${tx.account_id}`}
                      className="font-medium text-primary hover:underline"
                      onClick={() => onOpenChange(false)}
                    >
                      {tx.accounts?.name || "Account"}
                    </Link>
                  ) : (
                    "—"
                  )}
                  <span className="text-muted-foreground">→</span>
                  {tx.transfer_account_id ? (
                    <Link
                      href={`/finance/accounts/${tx.transfer_account_id}`}
                      className="font-medium text-primary hover:underline"
                      onClick={() => onOpenChange(false)}
                    >
                      {tx.transfer_accounts?.name || "Account"}
                    </Link>
                  ) : (
                    "—"
                  )}
                </span>
              ) : tx.account_id ? (
                <Link
                  href={`/finance/accounts/${tx.account_id}`}
                  className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                  onClick={() => onOpenChange(false)}
                >
                  <Building2 className="size-3.5" />
                  {tx.accounts?.name || "Account"}
                </Link>
              ) : (
                "—"
              )}
            </DetailRow>

            <DetailRow label="Customer">
              {tx.customer_id && tx.customers?.name ? (
                <Link
                  href={`/customers/${tx.customer_id}`}
                  className="font-medium text-primary hover:underline"
                  onClick={() => onOpenChange(false)}
                >
                  {tx.customers.name}
                </Link>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </DetailRow>

            <DetailRow label="Invoice">
              {tx.invoice_id && tx.invoices?.invoice_number ? (
                <Link
                  href={`/finance/invoices/${tx.invoice_id}`}
                  className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                  onClick={() => onOpenChange(false)}
                >
                  <FileText className="size-3.5" />
                  {tx.invoices.invoice_number}
                  <ExternalLink className="size-3 opacity-60" />
                </Link>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </DetailRow>

            <DetailRow label="Category">
              {tx.categories?.name || (
                <span className="text-muted-foreground">
                  {tx.type === "expense" ? "Uncategorized" : "—"}
                </span>
              )}
            </DetailRow>

            <DetailRow label="Reference">
              {tx.reference ? (
                <span className="break-all font-mono text-xs">
                  {tx.reference}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </DetailRow>

            <DetailRow label="Reconciled">
              {tx.reconciled_at ? (
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-4" />
                  {formatDate(tx.reconciled_at)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Minus className="size-4" />
                  Not reconciled
                </span>
              )}
            </DetailRow>

            <DetailRow label="Recorded">
              <span className="text-muted-foreground">
                {formatDate(tx.created_at)}
              </span>
            </DetailRow>
          </dl>
        </div>

        <DialogFooter className="shrink-0 border-t border-border px-5 py-3 sm:px-6">
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {tx.receipt_path ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void openReceipt()}
                >
                  View receipt
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void onReconcile()}
              >
                {tx.reconciled_at ? "Reopen" : "Mark reconciled"}
              </Button>
              {!tx.reconciled_at ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  disabled={busy}
                  onClick={() => void onDelete()}
                >
                  Delete
                </Button>
              ) : null}
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
