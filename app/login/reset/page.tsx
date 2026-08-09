import { AuthAmbientBackground } from "@/components/auth/auth-ambient-background";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <div className="dark relative flex min-h-svh items-center justify-center overflow-hidden bg-[#141414] px-4 py-10 text-foreground max-sm:min-h-dvh max-sm:overflow-y-auto max-sm:px-5 max-sm:py-[max(1.75rem,env(safe-area-inset-top))]">
      <AuthAmbientBackground />
      <div className="relative z-10 w-full max-w-[22rem]">
        <ResetPasswordForm />
      </div>
    </div>
  );
}
