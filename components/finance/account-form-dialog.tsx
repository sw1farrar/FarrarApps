"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Plus } from "lucide-react";
import { createAccount, updateAccount } from "@/lib/data/settings";
import type { Account } from "@/lib/types/database";
import { FormSelect } from "@/components/ui/form-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const ACCOUNT_TYPE_OPTIONS = [
  { value: "checking", label: "Checking account" },
  { value: "credit_card", label: "Credit card" },
  { value: "stripe", label: "Stripe clearing" },
];

export function AccountFormDialog({
  account,
  trigger,
  onCreated,
}: {
  /** When set, dialog edits this account (name, type, starting balance). */
  account?: Pick<
    Account,
    "id" | "name" | "type" | "opening_balance" | "is_active"
  >;
  trigger?: React.ReactNode;
  onCreated?: (account: { id: string; name: string }) => void;
}) {
  const router = useRouter();
  const isEdit = Boolean(account);
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [accountType, setAccountType] = React.useState<string>(
    account?.type ?? "checking"
  );
  const [openingBalance, setOpeningBalance] = React.useState(
    String(account?.opening_balance ?? 0)
  );

  React.useEffect(() => {
    if (!open) return;
    setAccountType(account?.type ?? "checking");
    setOpeningBalance(String(account?.opening_balance ?? 0));
  }, [open, account]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    formData.set("type", accountType);
    formData.set("opening_balance", openingBalance);
    if (account?.is_active !== false) {
      formData.set("is_active", "on");
    }

    const result = isEdit
      ? await updateAccount(account!.id, formData)
      : await createAccount(formData);
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(isEdit ? "Account updated" : "Account added");
    setOpen(false);
    if (!isEdit) {
      setAccountType("checking");
      setOpeningBalance("0");
    }
    router.refresh();
    if (!isEdit && result.id) {
      const name = String(formData.get("name") || "").trim();
      onCreated?.({ id: result.id, name });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ? (
            (trigger as React.ReactElement)
          ) : isEdit ? (
            <Button size="sm" variant="outline" type="button">
              <Pencil className="size-4" />
              Edit account
            </Button>
          ) : (
            <Button size="sm" variant="outline" type="button">
              <Plus className="size-4" />
              Add account
            </Button>
          )
        }
      />
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0" showCloseButton>
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3 sm:px-5">
          <DialogTitle>{isEdit ? "Edit account" : "New account"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update name, type, or starting balance. Balance on this account = starting balance ± all transactions."
              : "Checking, credit card, or Stripe. Set the starting balance to match your bank when you begin tracking."}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={onSubmit}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5"
        >
          <div className="space-y-1.5">
            <Label htmlFor="account-name">Name</Label>
            <Input
              id="account-name"
              name="name"
              required
              placeholder="Operating checking"
              defaultValue={account?.name ?? ""}
              key={account?.id ?? "new"}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="account-type">Type</Label>
              <FormSelect
                id="account-type"
                name="type"
                value={accountType}
                onValueChange={setAccountType}
                options={ACCOUNT_TYPE_OPTIONS}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="opening_balance">Starting balance</Label>
              <Input
                id="opening_balance"
                name="opening_balance"
                type="number"
                step="0.01"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-[11px] text-muted-foreground">
                For credit cards, use the amount you currently owe.
              </p>
            </div>
          </div>
          <DialogFooter className="mx-0 mb-0 border-0 bg-transparent p-0 pt-2">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Save changes" : "Create account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
