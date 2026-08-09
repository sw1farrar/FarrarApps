"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  inviteCustomerToPortal,
  unlinkPortalAccess,
  type PendingPortalInvite,
} from "@/lib/data/portal";
import type { Customer, CustomerMember } from "@/lib/types/database";
import { PortalTeamManager } from "@/components/portal/portal-team-manager";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function InvitePortalButton({
  customer,
  pendingInvites,
  members,
}: {
  customer: Customer;
  pendingInvites?: PendingPortalInvite[];
  members?: CustomerMember[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, setPending] = React.useState<"invite" | "unlink" | null>(
    null
  );
  const hasMembers = (members?.length ?? 0) > 0 || Boolean(customer.portal_user_id);

  async function run(
    action: "invite" | "unlink",
    fn: () => Promise<{ ok: boolean; error?: string; message?: string }>
  ) {
    setPending(action);
    const result = await fn();
    setPending(null);
    if (!result.ok) {
      toast.error(result.error || "Something went wrong");
      return;
    }
    toast.success(result.message || "Updated");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {hasMembers ? (
          <Badge variant="secondary" className="h-8 px-2.5 font-normal">
            Portal linked ({members?.length ?? 1})
          </Badge>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              run("invite", () => inviteCustomerToPortal(customer.id))
            }
            disabled={pending !== null || !customer.email}
            title={
              !customer.email
                ? "Add an email before inviting"
                : "Send portal invite to primary email"
            }
          >
            {pending === "invite" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            Invite primary email
          </Button>
        )}
        {hasMembers ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending !== null}
            onClick={() => {
              void (async () => {
                const ok = await confirm({
                  title: "Unlink all portal access?",
                  description:
                    "Remove all portal members and invites for this customer.",
                  confirmLabel: "Unlink all",
                  variant: "destructive",
                });
                if (!ok) return;
                await run("unlink", () => unlinkPortalAccess(customer.id));
              })();
            }}
          >
            {pending === "unlink" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            Unlink all
          </Button>
        ) : null}
      </div>
      <PortalTeamManager
        customerId={customer.id}
        members={members ?? []}
        pendingInvites={pendingInvites ?? []}
        canManage
      />
    </div>
  );
}
