import { LoginForm } from "@/components/auth/login-form";
import { AuthAmbientBackground } from "@/components/auth/auth-ambient-background";
import { getStaffInviteByToken } from "@/lib/data/staff";
import { getPortalInviteByToken } from "@/lib/data/portal";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    email?: string;
    invite?: string;
    portal_invite?: string;
    next?: string;
  }>;
}) {
  const params = await searchParams;
  const staffInvite = params.invite
    ? await getStaffInviteByToken(params.invite)
    : null;
  const portalInvite = params.portal_invite
    ? await getPortalInviteByToken(params.portal_invite)
    : null;
  const portalSignIn =
    Boolean(params.portal_invite) ||
    Boolean(params.next && params.next.startsWith("/portal"));

  return (
    <div className="dark relative flex min-h-svh items-center justify-center overflow-hidden bg-[#141414] px-4 py-10 text-foreground max-sm:min-h-dvh max-sm:overflow-y-auto max-sm:px-5 max-sm:py-[max(1.75rem,env(safe-area-inset-top))]">
      <AuthAmbientBackground />

      <div className="relative z-10 w-full max-w-[22rem]">
        <LoginForm
          defaultEmail={
            portalInvite?.email || staffInvite?.email || params.email
          }
          defaultFullName={
            portalInvite?.customer_name || staffInvite?.full_name || undefined
          }
          inviteToken={params.invite}
          invitedRole={staffInvite?.role}
          portalInviteToken={params.portal_invite}
          portalInviteValid={
            params.portal_invite ? Boolean(portalInvite) : true
          }
          portalCustomerName={portalInvite?.customer_name}
          portalSignIn={portalSignIn}
          nextPath={params.next}
        />
      </div>
    </div>
  );
}
