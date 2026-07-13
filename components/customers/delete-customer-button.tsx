"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteCustomer } from "@/lib/data/customers";
import { Button } from "@/components/ui/button";

export function DeleteCustomerButton({ customerId }: { customerId: string }) {
  const router = useRouter();

  async function onDelete() {
    if (!confirm("Delete this customer? Linked projects may block deletion.")) {
      return;
    }
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
    <Button variant="destructive" size="sm" onClick={onDelete}>
      Delete
    </Button>
  );
}
