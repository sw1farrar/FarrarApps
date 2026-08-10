"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { startReconciliation } from "@/lib/data/reconciliations";
import { toCalendarDateString } from "@/lib/format";
import type { Account } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSelect } from "@/components/ui/form-select";

export function StartReconcileForm({
  accounts,
  defaultAccountId = "",
}: {
  accounts: Account[];
  defaultAccountId?: string;
}) {
  const router = useRouter();
  const [accountId, setAccountId] = React.useState(
    defaultAccountId || accounts[0]?.id || ""
  );
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const statementDate = String(form.get("statement_date") || "");
    const statementBalance = Number(form.get("statement_balance") || 0);
    setPending(true);
    const result = await startReconciliation({
      accountId,
      statementDate,
      statementBalance,
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Reconciliation ready");
    router.push(`/finance/reconcile/${result.id}`);
    router.refresh();
  }

  if (!accounts.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Add a bank account before reconciling.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-xl gap-3 sm:grid-cols-3">
      <div className="space-y-1.5 sm:col-span-3">
        <Label>Account</Label>
        <FormSelect
          value={accountId}
          onValueChange={setAccountId}
          options={accounts.map((a) => ({
            value: a.id,
            label: `${a.name} (${a.type === "stripe" ? "Stripe" : a.type === "credit_card" ? "Card" : "Checking"})`,
          }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="statement_date">Statement date</Label>
        <Input
          id="statement_date"
          name="statement_date"
          type="date"
          required
          defaultValue={toCalendarDateString()}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="statement_balance">Statement ending balance</Label>
        <Input
          id="statement_balance"
          name="statement_balance"
          type="number"
          step="0.01"
          required
          defaultValue="0"
        />
      </div>
      <div className="flex items-end">
        <Button type="submit" size="sm" disabled={pending || !accountId}>
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          Start reconcile
        </Button>
      </div>
    </form>
  );
}
