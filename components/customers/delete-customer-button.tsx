"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteCustomer } from "@/lib/data/customers";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";

export function DeleteCustomerButton({ customerId }: { customerId: string }) {
  const router = useRouter();
  const confirm = useConfirm();

  async function onDelete() {
    const ok = await confirm({
      title: "Delete this customer?",
      description:
        "This cannot be undone. Linked projects or invoices may block deletion.",
      confirmLabel: "Delete customer",
      variant: "destructive",
    });
    if (!ok) return;
    const result = await deleteCustomer(customerId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Customer deleted");
    router.push("/customers");
    router.refresh();
  }

  return (
    <Button variant="destructive" size="sm" onClick={() => void onDelete()}>
      Delete
    </Button>
  );
}
