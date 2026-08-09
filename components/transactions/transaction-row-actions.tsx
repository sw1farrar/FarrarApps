"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  deleteTransaction,
  getReceiptSignedUrl,
  setTransactionReconciled,
} from "@/lib/data/transactions";
import type { Transaction } from "@/lib/types/database";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";

export function TransactionRowActions({ tx }: { tx: Transaction }) {
  const router = useRouter();
  const confirm = useConfirm();

  async function openReceipt() {
    if (!tx.receipt_path) return;
    const result = await getReceiptSignedUrl(tx.receipt_path);
    if (!result.ok || !result.url) {
      toast.error(result.ok ? "Receipt link unavailable" : result.error);
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  async function onDelete() {
    const ok = await confirm({
      title: "Delete this transaction?",
      description: "This cannot be undone.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    const result = await deleteTransaction(tx.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Transaction deleted");
    router.refresh();
  }

  async function onReconcile() {
    const result = await setTransactionReconciled(tx.id, !tx.reconciled_at);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      tx.reconciled_at ? "Transaction reopened" : "Transaction reconciled"
    );
    router.refresh();
  }

  return (
    <div className="flex justify-end gap-1">
      {tx.receipt_path ? (
        <Button size="sm" variant="outline" onClick={() => void openReceipt()}>
          Receipt
        </Button>
      ) : null}
      <Button size="sm" variant="ghost" onClick={() => void onReconcile()}>
        {tx.reconciled_at ? "Reopen" : "Reconcile"}
      </Button>
      {!tx.reconciled_at ? (
        <Button size="sm" variant="ghost" onClick={() => void onDelete()}>
          Delete
        </Button>
      ) : null}
    </div>
  );
}
