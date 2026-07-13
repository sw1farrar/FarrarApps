"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { inviteCustomerToPortal } from "@/lib/data/portal";
import type { Customer } from "@/lib/types/database";
import { Button } from "@/components/ui/button";

export function InvitePortalButton({ customer }: { customer: Customer }) {
  const router = useRouter();

  async function onInvite() {
    const result = await inviteCustomerToPortal(customer.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message || "Portal invite updated");
    router.refresh();
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onInvite}
      disabled={Boolean(customer.portal_user_id)}
    >
      {customer.portal_user_id ? "Portal linked" : "Invite to portal"}
    </Button>
  );
}
