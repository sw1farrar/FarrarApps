"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { deleteAccount, setAccountActive } from "@/lib/data/settings";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";

export function DeleteAccountButton({
  accountId,
  accountName,
}: {
  accountId: string;
  accountName: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, setPending] = React.useState<"delete" | "deactivate" | null>(
    null
  );

  async function onDelete() {
    const ok = await confirm({
      title: `Delete “${accountName}”?`,
      description:
        "This cannot be undone. Accounts with transactions cannot be deleted — deactivate them instead.",
      confirmLabel: "Delete account",
      variant: "destructive",
    });
    if (!ok) return;
    setPending("delete");
    const result = await deleteAccount(accountId);
    setPending(null);
    if (!result.ok) {
      toast.error(result.error, {
        action: {
          label: "Deactivate",
          onClick: () => {
            void onDeactivate();
          },
        },
      });
      return;
    }
    toast.success("Account deleted");
    router.push("/finance/accounts");
    router.refresh();
  }

  async function onDeactivate() {
    setPending("deactivate");
    const result = await setAccountActive(accountId, false);
    setPending(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Account deactivated");
    router.push("/finance/accounts");
    router.refresh();
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      disabled={pending !== null}
      onClick={() => void onDelete()}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Trash2 className="size-4" />
      )}
      Delete
    </Button>
  );
}
