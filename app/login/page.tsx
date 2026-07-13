import { LoginForm } from "@/components/auth/login-form";
import { AuthAmbientBackground } from "@/components/auth/auth-ambient-background";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[oklch(0.12_0_0)] px-4 py-10 max-sm:min-h-dvh max-sm:overflow-y-auto max-sm:px-5 max-sm:py-[max(1.75rem,env(safe-area-inset-top))]">
      <AuthAmbientBackground />

      <div className="relative z-10 w-full max-w-[22rem]">
        <LoginForm defaultEmail={params.email} />
      </div>
    </div>
  );
}
