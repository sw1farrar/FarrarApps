"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  completeReconciliation,
  setReconciliationItems,
  voidReconciliation,
} from "@/lib/data/reconciliations";
import { amountForAccount } from "@/lib/data/account-balances";
import { formatCurrency, formatDate, titleCase } from "@/lib/format";
import type { Account, Reconciliation, Transaction } from "@/lib/types/database";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function ReconcileWorkspace({
  reconciliation,
  account,
  candidates,
  initialSelectedIds,
  initialDifference,
}: {
  reconciliation: Reconciliation;
  account: Account;
  candidates: Transaction[];
  initialSelectedIds: string[];
  initialDifference: number;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(initialSelectedIds)
  );
  const [pending, setPending] = React.useState<string | null>(null);
  const readonly = reconciliation.status !== "in_progress";

  const clearedTotal = React.useMemo(() => {
    let sum = 0;
    for (const tx of candidates) {
      if (selected.has(tx.id)) sum += amountForAccount(account, tx);
    }
    return sum;
  }, [candidates, selected, account]);

  // Difference provided from server for base; recompute client-side delta from selection change
  const selectionDelta =
    [...selected].reduce((sum, id) => {
      if (initialSelectedIds.includes(id)) return sum;
      const tx = candidates.find((t) => t.id === id);
      return tx ? sum + amountForAccount(account, tx) : sum;
    }, 0) -
    initialSelectedIds.reduce((sum, id) => {
      if (selected.has(id)) return sum;
      const tx = candidates.find((t) => t.id === id);
      return tx ? sum + amountForAccount(account, tx) : sum;
    }, 0);

  const difference = initialDifference - selectionDelta;

  function toggle(id: string) {
    if (readonly) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveSelection() {
    setPending("save");
    const result = await setReconciliationItems(reconciliation.id, [
      ...selected,
    ]);
    setPending(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Selection saved");
    router.refresh();
  }

  async function onComplete(force?: boolean) {
    setPending("complete");
    await setReconciliationItems(reconciliation.id, [...selected]);
    const result = await completeReconciliation(reconciliation.id, { force });
    setPending(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Reconciliation completed");
    router.refresh();
  }

  async function onVoid() {
    const ok = await confirm({
      title: "Void this reconciliation?",
      description: "The open session will be discarded. Transactions stay as they are.",
      confirmLabel: "Void",
      variant: "destructive",
    });
    if (!ok) return;
    setPending("void");
    const result = await voidReconciliation(reconciliation.id);
    setPending(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Reconciliation voided");
    router.push("/finance/reconcile");
    router.refresh();
  }

  async function onForceComplete() {
    const ok = await confirm({
      title: "Force complete with a difference?",
      description:
        "The statement balance does not match cleared items. Complete anyway?",
      confirmLabel: "Force complete",
      variant: "destructive",
    });
    if (!ok) return;
    await onComplete(true);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Statement balance</p>
          <p className="text-lg font-semibold tabular-nums">
            {formatCurrency(Number(reconciliation.statement_balance))}
          </p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Cleared total (signed)</p>
          <p className="text-lg font-semibold tabular-nums">
            {formatCurrency(clearedTotal)}
          </p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Difference</p>
          <p
            className={`text-lg font-semibold tabular-nums ${
              Math.abs(difference) < 0.01
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-amber-600 dark:text-amber-400"
            }`}
          >
            {formatCurrency(difference)}
          </p>
          <p className="text-xs text-muted-foreground">
            Status: {titleCase(reconciliation.status.replace("_", " "))}
          </p>
        </div>
      </div>

      {!readonly ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={pending !== null}
            onClick={() => void saveSelection()}
          >
            {pending === "save" && (
              <Loader2 className="size-3.5 animate-spin" />
            )}
            Save selection
          </Button>
          <Button
            size="sm"
            disabled={pending !== null}
            onClick={() => void onComplete(false)}
          >
            {pending === "complete" && (
              <Loader2 className="size-3.5 animate-spin" />
            )}
            Complete
          </Button>
          {Math.abs(difference) >= 0.01 ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending !== null}
              onClick={() => void onForceComplete()}
            >
              Force complete
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            disabled={pending !== null}
            onClick={() => void onVoid()}
          >
            Void
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {candidates.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-8 text-center text-muted-foreground"
                >
                  No candidate transactions through{" "}
                  {formatDate(reconciliation.statement_date)}.
                </TableCell>
              </TableRow>
            ) : (
              candidates.map((tx) => {
                const amt = amountForAccount(account, tx);
                return (
                  <TableRow
                    key={tx.id}
                    className={readonly ? undefined : "cursor-pointer"}
                    onClick={() => toggle(tx.id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(tx.id)}
                        disabled={readonly}
                        onCheckedChange={() => toggle(tx.id)}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(tx.date)}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">
                        {tx.description || "Untitled"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tx.type}
                        {tx.reference ? ` · ${tx.reference}` : ""}
                      </p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {amt < 0 ? "−" : ""}
                      {formatCurrency(Math.abs(amt))}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
