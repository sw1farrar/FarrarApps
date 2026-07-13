import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeviceVerifyForm } from "@/components/auth/device-verify-form";
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
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.38_0_0)_0%,_transparent_58%)] opacity-50 dark:opacity-70"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative z-10 w-full max-w-[22rem]">
        <DeviceVerifyForm email={user.email} />
      </div>
    </div>
  );
}
