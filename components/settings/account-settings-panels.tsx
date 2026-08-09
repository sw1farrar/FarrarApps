"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AccountNameForm } from "@/components/settings/account-name-form";
import { AccountEmailForm } from "@/components/settings/account-email-form";
import { AccountPasswordForm } from "@/components/settings/account-password-form";
import type { Profile } from "@/lib/types/database";

export function AccountSettingsPanels({ profile }: { profile: Profile }) {
  const email = profile.email || "";

  return (
    <div className="space-y-4">
      <Card className="shadow-none">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm">Name</CardTitle>
          <CardDescription className="text-xs">
            How you appear in the app. Add a name if the sidebar still shows
            your email or an automatic label.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <AccountNameForm
            fullName={profile.full_name || ""}
            profile={profile}
          />
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm">Email</CardTitle>
          <CardDescription className="text-xs">
            Change your login email. We send a code to the new address; the
            change applies only after you verify it.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <AccountEmailForm currentEmail={email} profile={profile} />
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm">Password</CardTitle>
          <CardDescription className="text-xs">
            Update your password while signed in. Other trusted devices stay
            signed in.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <AccountPasswordForm currentEmail={email} />
        </CardContent>
      </Card>
    </div>
  );
}
