import Link from "next/link";
import { AccountSettingsPanels } from "@/components/settings/account-settings-panels";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { requirePortalContext } from "@/lib/data/portal-context";
import { cn } from "@/lib/utils";

export default async function PortalSettingsPage() {
  const { profile, customer, memberRole } = await requirePortalContext();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your name, login email, and password for this portal account.
        </p>
      </div>

      <AccountSettingsPanels profile={profile} />

      <Card className="shadow-none">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm">Linked customer</CardTitle>
          <CardDescription className="text-xs">
            Company and billing contact details (not your login email)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 p-3 pt-0 text-sm">
          <div className="flex justify-between gap-4 border-b border-border py-2">
            <span className="text-muted-foreground">Customer</span>
            <span className="text-right font-medium">
              {customer?.name || "Not linked"}
            </span>
          </div>
          <div className="flex justify-between gap-4 border-b border-border py-2">
            <span className="text-muted-foreground">Company</span>
            <span className="text-right font-medium">
              {customer?.company || "—"}
            </span>
          </div>
          <div className="flex justify-between gap-4 py-2">
            <span className="text-muted-foreground">Contact email</span>
            <span className="text-right font-medium">
              {customer?.email || profile.email}
            </span>
          </div>
        </CardContent>
      </Card>

      {memberRole === "company_admin" && customer ? (
        <Card className="shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
            <div>
              <CardTitle className="text-sm">Team</CardTitle>
              <CardDescription className="text-xs">
                Invite coworkers to this portal
              </CardDescription>
            </div>
            <Link
              href="/portal/settings/team"
              className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
            >
              Manage team
            </Link>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  );
}
