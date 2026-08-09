import { PortalTeamManager } from "@/components/portal/portal-team-manager";
import { requirePortalContext } from "@/lib/data/portal-context";
import {
  getCustomerMembers,
  getPendingPortalInvites,
} from "@/lib/data/portal";
import { redirect } from "next/navigation";

export default async function PortalTeamSettingsPage() {
  const { customer, memberRole } = await requirePortalContext();
  if (!customer) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-lg font-semibold">Team</h1>
        <p className="text-sm text-muted-foreground">
          Link your account to a customer before managing teammates.
        </p>
      </div>
    );
  }

  if (memberRole !== "company_admin") {
    redirect("/portal/settings");
  }

  const [members, pendingInvites] = await Promise.all([
    getCustomerMembers(customer.id),
    getPendingPortalInvites(customer.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground">
          Invite coworkers at {customer.name} to the client portal.
        </p>
      </div>
      <PortalTeamManager
        customerId={customer.id}
        members={members}
        pendingInvites={pendingInvites}
        canManage
      />
    </div>
  );
}
