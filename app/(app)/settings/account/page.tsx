import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { AccountSettingsPanels } from "@/components/settings/account-settings-panels";

export default async function SettingsAccountPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Account</h1>
        <p className="text-sm text-muted-foreground">
          Manage your name, login email, and password.
        </p>
      </div>
      <AccountSettingsPanels profile={profile} />
    </div>
  );
}
