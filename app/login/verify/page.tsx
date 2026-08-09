import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeviceVerifyForm } from "@/components/auth/device-verify-form";
import { AuthAmbientBackground } from "@/components/auth/auth-ambient-background";
import {
  getOrCreateDeviceToken,
  isDeviceTrustedForUser,
  sendDeviceChallengeEmail,
} from "@/lib/auth/device-actions";

export default async function DeviceVerifyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const deviceToken = await getOrCreateDeviceToken();
  const trusted = await isDeviceTrustedForUser(user.id, deviceToken);
  if (trusted) {
    redirect("/dashboard");
  }

  await sendDeviceChallengeEmail();

  return (
    <div className="dark relative flex min-h-svh items-center justify-center overflow-hidden bg-[#141414] px-4 py-10 text-foreground max-sm:min-h-dvh max-sm:overflow-y-auto max-sm:px-5 max-sm:py-[max(1.75rem,env(safe-area-inset-top))]">
      <AuthAmbientBackground />

      <div className="relative z-10 w-full max-w-[22rem]">
        <DeviceVerifyForm email={user.email} />
      </div>
    </div>
  );
}
